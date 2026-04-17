import { premblyRequest } from "./premblyClient.js";

export async function verifyPlatePrembly({ plate_number }) {
  const endpoint =
    process.env.PREMBLY_PLATE_ENDPOINT || "/verification/vehicle";
  const field = process.env.PREMBLY_PLATE_FIELD || "vehicle_number";

  if (!plate_number) throw new Error("plate_number is required for verification");

  return premblyRequest({
    endpoint,
    method: "POST",
    body: { [field]: plate_number }
  });
}
