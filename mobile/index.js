import { registerRootComponent } from 'expo';
import App from './App';
// Phase 1 is informational in every profile. Do not register background health
// work or import its native providers while operational capabilities are held.

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately.
registerRootComponent(App);
