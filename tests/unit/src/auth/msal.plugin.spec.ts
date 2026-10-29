import type { RedisClientType } from "redis";

import { expect } from "chai";
import sinon from "sinon";

import { TokenCacheContext } from "@azure/msal-node";
import { MsalCacheWithoutExpiringSessionError } from "#/auth/auth.errors.js";
import { getMsalCacheKey } from "#/auth/msal.cache.js";
import { MINUTE } from "#/lib/constants/time.js";
import { RedisCachePlugin } from "#/auth/msal.plugin.js";
describe("CachePlugin", () => {
  describe("Redis", () => {
    const SESSION_ID = "test-session-id-123";
    const OTHER_SESSION_ID = "other-session-id-456";
    const CACHE_KEY = getMsalCacheKey(SESSION_ID);
    const OTHER_CACHE_KEY = getMsalCacheKey(OTHER_SESSION_ID);
    const SERIALIZED_CACHE = "serialized-cache-blob";

    function createObservableCacheContext(): {
      context: TokenCacheContext;
      getCachedValue: () => string | undefined;
    } {
      let cachedValue: string | undefined;
      const context = {
        cacheHasChanged: false,
        tokenCache: {
          deserialize: (value: string) => {
            cachedValue = value;
          },
          serialize: () => cachedValue ?? SERIALIZED_CACHE,
        },
      } as unknown as TokenCacheContext;

      return { context, getCachedValue: () => cachedValue };
    }

    let redisStub: sinon.SinonStubbedInstance<RedisClientType>;
    let plugin: RedisCachePlugin;
    let cacheContextStub: {
      cacheHasChanged: boolean;
      tokenCache: { deserialize: sinon.SinonStub; serialize: sinon.SinonStub };
    };

    beforeEach(() => {
      redisStub = {
        expire: sinon.stub(),
        get: sinon.stub(),
        pExpireAt: sinon.stub(),
        pExpireTime: sinon.stub(),
        set: sinon.stub(),
      } as sinon.SinonStubbedInstance<RedisClientType>;

      plugin = new RedisCachePlugin(redisStub, SESSION_ID);

      cacheContextStub = {
        cacheHasChanged: false,
        tokenCache: {
          deserialize: sinon.stub(),
          serialize: sinon.stub().returns(SERIALIZED_CACHE),
        },
      };
    });

    afterEach(() => {
      sinon.restore();
    });

    describe("beforeCacheAccess()", () => {
      it("should include prefix 'msal:' and session ID in cache key", async () => {
        redisStub.get.resolves(null);

        await plugin.beforeCacheAccess(
          cacheContextStub as unknown as TokenCacheContext,
        );

        const callArg = redisStub.get.firstCall.args[0];
        expect(callArg).to.include("msal:");
        expect(callArg).to.include(SESSION_ID);
      });
      
      it("leaves the token cache empty when Redis has no cached value", async () => {
        const observableCache = createObservableCacheContext();
        redisStub.get.resolves(null);

        await plugin.beforeCacheAccess(observableCache.context);

        expect(observableCache.getCachedValue()).to.be.undefined;
        expect(redisStub.expire.called).to.be.false;
      });

      it("does not renew cache expiry when no deadline is configured", async () => {
        redisStub.get.resolves(SERIALIZED_CACHE);

        await plugin.beforeCacheAccess(
          cacheContextStub as unknown as TokenCacheContext,
        );

        expect(redisStub.get.calledWith(CACHE_KEY)).to.be.true;
        expect(
          cacheContextStub.tokenCache.deserialize.calledWith(SERIALIZED_CACHE),
        ).to.be.true;
        expect(redisStub.expire.called).to.be.false;
      });

      it("uses the authenticated session deadline when refreshing cache expiry", async () => {
        const cacheExpiresAt = Date.now() + 30 * MINUTE;
        const deadlinePlugin = new RedisCachePlugin(
          redisStub,
          SESSION_ID,
          cacheExpiresAt,
        );
        redisStub.get.resolves(SERIALIZED_CACHE);

        await deadlinePlugin.beforeCacheAccess(
          cacheContextStub as unknown as TokenCacheContext,
        );

        expect(
          redisStub.pExpireAt.calledOnceWithExactly(CACHE_KEY, cacheExpiresAt),
        ).to.be.true;
      });

      it("keeps cached values isolated between session IDs", async () => {
        const otherPlugin = new RedisCachePlugin(
          redisStub,
          OTHER_SESSION_ID,
        );
        const thisSessionCache = createObservableCacheContext();
        const otherSessionCache = createObservableCacheContext();

        redisStub.get.withArgs(CACHE_KEY).resolves(SERIALIZED_CACHE);
        redisStub.get.withArgs(OTHER_CACHE_KEY).resolves("other-serialized");

        await plugin.beforeCacheAccess(thisSessionCache.context);
        await otherPlugin.beforeCacheAccess(otherSessionCache.context);

        expect(thisSessionCache.getCachedValue()).to.equal(SERIALIZED_CACHE);
        expect(otherSessionCache.getCachedValue()).to.equal("other-serialized");
      });
    });

    describe("afterCacheAccess()", () => {
      it("should not write to Redis when cache has not changed", async () => {
        cacheContextStub.cacheHasChanged = false;

        await plugin.afterCacheAccess(
          cacheContextStub as unknown as TokenCacheContext,
        );

        expect(redisStub.set.called).to.be.false;
      });

      it("persists changed cache with its Redis expiry", async () => {
        cacheContextStub.cacheHasChanged = true;
        const cacheExpiresAt = Date.now() + 30 * MINUTE;
        redisStub.pExpireTime.resolves(cacheExpiresAt);
        redisStub.set.resolves(null);

        await plugin.afterCacheAccess(
          cacheContextStub as unknown as TokenCacheContext,
        );

        expect(
          redisStub.pExpireTime.calledOnceWithExactly(CACHE_KEY),
        ).to.be.true;
        expect(
          redisStub.set.calledOnceWithExactly(CACHE_KEY, SERIALIZED_CACHE, {
            PXAT: cacheExpiresAt,
          }),
        ).to.be.true;
      });

      it("does not persist changed cache without an existing expiry", async () => {
        cacheContextStub.cacheHasChanged = true;
        redisStub.pExpireTime.resolves(-2);

        let error: unknown;
        try {
          await plugin.afterCacheAccess(
            cacheContextStub as unknown as TokenCacheContext,
          );
        } catch (caught) {
          error = caught;
        }

        expect(error).to.be.instanceOf(MsalCacheWithoutExpiringSessionError);
        expect(error).to.have.property(
          "message",
          "Cannot persist MSAL cache without an expiring session",
        );
        expect(redisStub.set.called).to.be.false;
      });

      it("uses the authenticated session deadline without querying Redis", async () => {
        cacheContextStub.cacheHasChanged = true;
        const cacheExpiresAt = Date.now() + 30 * MINUTE;
        const deadlinePlugin = new RedisCachePlugin(
          redisStub,
          SESSION_ID,
          cacheExpiresAt,
        );
        redisStub.set.resolves(null);

        await deadlinePlugin.afterCacheAccess(
          cacheContextStub as unknown as TokenCacheContext,
        );

        expect(redisStub.pExpireTime.called).to.be.false;
        expect(
          redisStub.set.calledOnceWithExactly(
            CACHE_KEY,
            SERIALIZED_CACHE,
            { PXAT: cacheExpiresAt },
          ),
        ).to.be.true;
      });
    });
  });
});
