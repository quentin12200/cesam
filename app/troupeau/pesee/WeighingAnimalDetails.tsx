import {
  ageAlertLabel,
  fieldAgeInfo,
  motherNumberLabel,
  weightProgressLabel,
  type FieldSessionEntry,
} from "@/lib/field-weighing";

export default function WeighingAnimalDetails({
  entry,
  showProgress = true,
}: {
  entry: FieldSessionEntry;
  showProgress?: boolean;
}) {
  const age = fieldAgeInfo(entry.birthDate);
  const ageAlert = ageAlertLabel(age.alert);

  return (
    <>
      <p className="text-sm font-bold">
        {motherNumberLabel(entry)} · {age.label}
        {ageAlert && (
          <> · <span className={age.alert === "approaching" ? "text-orange-700" : "bg-orange-200 px-1 text-black"}>{ageAlert}</span></>
        )}
      </p>
      {showProgress && <p className="text-sm font-extrabold">{weightProgressLabel(entry)}</p>}
    </>
  );
}
