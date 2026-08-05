import type { Metadata } from "next";
import FieldWeighingSession from "./FieldWeighingSession";
import WeighingSessionDate from "./WeighingSessionDate";

export const metadata: Metadata = {
  title: "Pesée rapide | CESAM",
};

export default function PeseeRapidePage() {
  return (
    <>
      <FieldWeighingSession />
      <WeighingSessionDate />
    </>
  );
}
