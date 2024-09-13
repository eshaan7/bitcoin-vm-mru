import { StateMachine } from "@stackr/sdk/machine";

import genesisState from "./../../genesis-state.json";
import { BitcoinVMState } from "./state";
import { transitions } from "./transitions";

const btcStateMachine = new StateMachine({
  id: "bitcoin-vm",
  stateClass: BitcoinVMState,
  initialState: genesisState.state,
  on: transitions,
});

export { btcStateMachine };
