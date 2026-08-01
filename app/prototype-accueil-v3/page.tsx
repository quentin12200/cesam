import type { Metadata } from "next";
import PrototypeAccueilV3 from "./PrototypeAccueilV3";

export const metadata: Metadata = {
  title: "Prototype accueil V3 | CESAM",
  robots: { index: false, follow: false },
};

export default function PrototypeAccueilV3Page() {
  return <PrototypeAccueilV3 />;
}
