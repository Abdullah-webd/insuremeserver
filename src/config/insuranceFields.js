export const INSURANCE_PRESETS = [
  {
    id: "car",
    label: "Car Insurance",
    match: (type = "") => type.toLowerCase().includes("car"),
    fields: [
      { key: "policy_understood", label: "Policy Understood" },
      { key: "full_name", label: "Full Name" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "bvn", label: "BVN", verify: true },
      { key: "nin", label: "NIN", verify: true },
      { key: "car_make", label: "Car Make" },
      { key: "car_model", label: "Car Model" },
      { key: "car_year", label: "Car Year" },
      { key: "plate_number", label: "Plate Number", verify: true },
      { key: "car_image", label: "Car Image", media: true },
      { key: "evidence", label: "Evidence", media: true }
    ]
  },
  {
    id: "house",
    label: "House Insurance",
    match: (type = "") => type.toLowerCase().includes("house"),
    fields: [
      { key: "policy_understood", label: "Policy Understood" },
      { key: "full_name", label: "Full Name" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "bvn", label: "BVN", verify: true },
      { key: "nin", label: "NIN", verify: true },
      { key: "property_address", label: "Property Address" },
      { key: "property_type", label: "Property Type" },
      { key: "property_value", label: "Property Value" },
      { key: "property_images", label: "Property Images", media: true },
      { key: "documents", label: "Documents", media: true },
      { key: "evidence", label: "Evidence", media: true }
    ]
  },
  {
    id: "health",
    label: "Health Insurance",
    match: (type = "") => type.toLowerCase().includes("health"),
    fields: [
      { key: "policy_understood", label: "Policy Understood" },
      { key: "full_name", label: "Full Name" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "bvn", label: "BVN", verify: true },
      { key: "nin", label: "NIN", verify: true },
      { key: "medical_history", label: "Medical History" },
      { key: "preferred_hospital", label: "Preferred Hospital" },
      { key: "documents", label: "Documents", media: true },
      { key: "evidence", label: "Evidence", media: true }
    ]
  },
  {
    id: "life",
    label: "Life Insurance",
    match: (type = "") => type.toLowerCase().includes("life"),
    fields: [
      { key: "policy_understood", label: "Policy Understood" },
      { key: "full_name", label: "Full Name" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "bvn", label: "BVN", verify: true },
      { key: "nin", label: "NIN", verify: true },
      { key: "beneficiary_name", label: "Beneficiary Name" },
      { key: "beneficiary_phone", label: "Beneficiary Phone" },
      { key: "documents", label: "Documents", media: true },
      { key: "evidence", label: "Evidence", media: true }
    ]
  }
];

export function getPresetForType(type = "") {
  return (
    INSURANCE_PRESETS.find((preset) => preset.match(type)) || {
      id: "custom",
      label: "Custom Insurance",
      fields: []
    }
  );
}
