// @aircon/core — pure business logic shared by web (Next.js) and mobile (Expo/RN).
// snu/yonsei는 같은 이름 export (BUILDINGS, search) 가 있어 namespace로 노출.

export * from './places';
export * from './subway';
export * from './subwayGraph';
export * from './train';
export * from './tokens';
export * from './geo';
export * from './brands';
export * from './api';
export * from './subwayDirection';
export * from './buildBusPlace';
export * from './busRegion';
export * from './subwayProgress';
// validation은 server/client 모두에서 사용. 두 import 경로 (main + subpath) 통하도록
// selective re-export — `export *`는 places/tokens와 export name 충돌(PlaceType, VoteType).
// 충돌 없는 schema/helper만 main에서 그대로 import 가능.
export {
  PLACE_TYPES,
  PlaceTypeSchema,
  VOTE_TYPES,
  VoteTypeSchema,
  PlaceIdSchema,
  ID_PREFIX_TYPE,
  isFreeTypePrefix,
  CreatePlaceBodySchema,
  UpsertPlaceBodySchema,
  PostVoteBodySchema,
  SubwayMatchBodySchema,
  BusMatchBodySchema,
  BusRouteSearchQuerySchema,
  BusRouteStationsQuerySchema,
  BusRegionByCoordsQuerySchema,
  UserPlaceCreateBodySchema,
  parseBody,
} from './validation';
export type {
  CreatePlaceBody,
  UpsertPlaceBody,
  UserPlaceCreateBody,
} from './validation';

export * as snu from './snu';
export * as yonsei from './yonsei';
