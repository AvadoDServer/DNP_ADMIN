import { mountPoint } from "./data";
import { createSelector } from "reselect";
import { mapValues } from "lodash";
import * as loadingIds from "./loadingIds";

// Service > loadingStatus

export const getLoadingStatuses = createSelector(
  // Defensive default: some tests build a minimal store without this slice
  // mounted; treat that the same as "nothing loaded yet" instead of crashing.
  state => state[mountPoint] || {},
  loadingStatuses => loadingStatuses
);

/**
 * The `loadingId` variable is constant,
 * never changes on the lifetime of the components consuming it
 *
 * Returns true if the data has never been loaded and if is loading now
 * @param {string} loadingId
 * [Tested]
 */
export const getIsLoadingById = loadingId => {
  return createSelector(
    getLoadingStatuses,
    loadingStatuses =>
      Boolean(
        !(loadingStatuses[loadingId] || {}).isLoaded &&
          (loadingStatuses[loadingId] || {}).isLoading
      )
  );
};

/**
 * The `loadingId` variable is constant,
 * never changes on the lifetime of the components consuming it
 *
 * Returns true if the data has never been loaded and if is loading now
 * @param {string} loadingId
 * [Tested]
 */
export const getLoadingErrorById = loadingId => {
  return createSelector(
    getLoadingStatuses,
    loadingStatuses => (loadingStatuses[loadingId] || {}).error || ""
  );
};

/**
 * The `loadingId` variable is constant,
 * never changes on the lifetime of the components consuming it
 *
 * Returns true if the data has is loading now, EVEN if it has loaded in the past
 * @param {string} loadingId
 */
export const getIsLoadingStrictById = loadingId => {
  return createSelector(
    getLoadingStatuses,
    loadingStatuses => Boolean((loadingStatuses[loadingId] || {}).isLoading)
  );
};

/**
 * The `loadingId` variable is constant,
 * never changes on the lifetime of the components consuming it
 *
 * Returns true once the data has been received at least once, regardless of
 * whether it is loading again right now (e.g. a background refresh).
 * @param {string} loadingId
 */
export const getIsLoadedById = loadingId => {
  return createSelector(
    getLoadingStatuses,
    loadingStatuses => Boolean((loadingStatuses[loadingId] || {}).isLoaded)
  );
};

export const getIsLoading = mapValues(loadingIds, id => getIsLoadingById(id));
export const getIsLoaded = mapValues(loadingIds, id => getIsLoadedById(id));
export const getLoadingError = mapValues(loadingIds, id =>
  getLoadingErrorById(id)
);
