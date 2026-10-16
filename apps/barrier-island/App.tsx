import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import BarrierIslandKiosk from "./src/BarrierIslandKiosk";

export default function App() {
  return (
    <SafeAreaProvider>
      <BarrierIslandKiosk />
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
