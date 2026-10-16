import { StatusBar } from "expo-status-bar";
import BarrierIslandKiosk from "./src/BarrierIslandKiosk";

export default function App() {
  return (
    <>
      <BarrierIslandKiosk />
      <StatusBar hidden />
    </>
  );
}
