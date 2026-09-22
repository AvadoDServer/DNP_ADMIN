import { appStopped, appRestarting, coreAppDown } from "./apps";
import { consensusWithoutExecution, executionWithoutConsensus, monitoringMissing, metricsUnavailable } from "./setup";
import { updatesAvailable, coreUpdateAvailable, autoupdateOff, storeUnreachable } from "./updates";
import { portsClosed, noUpnp, noNatLoopback, remoteAccessMissing } from "./access";
import { diskHigh } from "./storage";
import { diagnoseFailed } from "./core";
import { chainSyncing, headBehind, lowPeers, missedAttestations } from "./chain";

export const ALL_RULES = [
  appStopped, appRestarting, coreAppDown,
  consensusWithoutExecution, executionWithoutConsensus, monitoringMissing, metricsUnavailable,
  updatesAvailable, coreUpdateAvailable, autoupdateOff, storeUnreachable,
  portsClosed, noUpnp, noNatLoopback, remoteAccessMissing,
  diskHigh, diagnoseFailed,
  chainSyncing, headBehind, lowPeers, missedAttestations,
];
