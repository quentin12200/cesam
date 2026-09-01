import type { Metadata } from "next";
import { DEMO_WORKSPACE_ANIMALS } from "./demo-data";
import PrototypeWorkspace from "./PrototypeWorkspace";

export const metadata: Metadata = {
  title: "Prototype espace de travail | CESAM",
  robots: { index: false, follow: false },
};

export default function PrototypeEspaceTravailPage() {
  return <PrototypeWorkspace initialAnimals={DEMO_WORKSPACE_ANIMALS} />;
}
