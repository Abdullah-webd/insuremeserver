import { dojahRequest } from "./dojahClient.js";

export async function verifyBVN({ bvn }) {
  const endpoint =
    process.env.DOJAH_BVN_ENDPOINT || "/api/v1/kyc/bvn/full";
  if (!bvn) throw new Error("BVN is required for verification");

  return dojahRequest({ endpoint, method: "GET", query: { bvn } });
}

export async function verifyNIN({ nin, first_name, last_name, dob }) {
  const endpoint = process.env.DOJAH_NIN_ENDPOINT || "/api/v1/kyc/nin";
  if (!nin) throw new Error("NIN is required for verification");

  const query = { nin };
  if (first_name) query.first_name = first_name;
  if (last_name) query.last_name = last_name;
  if (dob) query.date_of_birth = dob;

  return dojahRequest({ endpoint, method: "GET", query });
}
