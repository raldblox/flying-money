declare module 'ioredis-mock' {
  import type { Redis } from 'ioredis'

  const RedisMock: new () => Redis
  export default RedisMock
}
