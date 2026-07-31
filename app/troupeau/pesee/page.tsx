import type { Metadata } from "next";
import FieldWeighingSession from "./FieldWeighingSession";

export const metadata: Metadata = {
  title: "Pesée rapide | CESAM",
};

export default function PeseeRapidePage() {
  return <FieldWeighingSession />;
}
