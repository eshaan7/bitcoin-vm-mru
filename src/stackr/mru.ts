import { MicroRollup } from "@stackr/sdk";

import { stackrConfig } from "../../stackr.config";
import { BitcoinLockTimeStrategy } from "./bitcoin-locktime-strategy";
import { btcStateMachine } from "./machine";
import { initBridge } from "./bridge";

const mru = await MicroRollup({
  config: stackrConfig,
  stateMachines: [btcStateMachine],
});

mru.sequencer.setStrategy(new BitcoinLockTimeStrategy());
initBridge(mru);
await mru.init();

export { mru };
