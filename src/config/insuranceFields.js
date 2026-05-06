export const INSURANCE_PRESETS = [
  {
    id: "car",
    label: "Car Insurance",
    match: (type = "") => type.toLowerCase().includes("car"),
    fields: [
      { key: "policy_understood", label: "Policy Understood" },
      { key: "full_name", label: "Full Name" },
      { key: "date_of_birth", label: "Date of Birth" },
      { key: "gender", label: "Gender" },
      { key: "address", label: "Address" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "occupation", label: "Occupation" },
      { key: "car_make", label: "Car Make" },
      { key: "car_model", label: "Car Model" },
      { key: "car_year", label: "Car Year" },
      { key: "car_value", label: "Car Value (NGN)" },
      { key: "vin", label: "Vehicle Identification Number (VIN)" },
      { key: "driver_license_number", label: "Driver’s License Number" },
      { key: "driving_history", label: "Driving History" },
      { key: "vehicle_usage", label: "Vehicle Usage" },
      { key: "vehicle_location", label: "Vehicle Location" },
      { key: "plate_number", label: "Plate Number", verify: true },
      { key: "car_image", label: "Car Image", media: true },
      { key: "documents", label: "Documents", media: true },
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
      { key: "date_of_birth", label: "Date of Birth" },
      { key: "gender", label: "Gender" },
      { key: "address", label: "Residential Address" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "occupation", label: "Occupation" },
      { key: "property_address", label: "Property Address" },
      { key: "property_type", label: "Property Type" },
      { key: "property_value", label: "Property Value" },
      { key: "property_year_built", label: "Year Built" },
      { key: "property_condition", label: "Property Condition" },
      { key: "security_features", label: "Security Features" },
      { key: "area_risks", label: "Area Risks" },
      { key: "contents_value", label: "Contents Value (NGN)" },
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
      { key: "date_of_birth", label: "Date of Birth" },
      { key: "gender", label: "Gender" },
      { key: "address", label: "Address" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "occupation", label: "Occupation" },
      { key: "current_health_condition", label: "Current Health Condition" },
      { key: "pre_existing_conditions", label: "Existing Illnesses / Conditions" },
      { key: "hospital_visits", label: "Previous Hospital Visits" },
      { key: "medications", label: "Current Medications" },
      { key: "lifestyle_habits", label: "Lifestyle Habits" },
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
      { key: "date_of_birth", label: "Date of Birth" },
      { key: "gender", label: "Gender" },
      { key: "address", label: "Address" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "occupation", label: "Occupation" },
      { key: "income", label: "Income" },
      { key: "medical_history", label: "Medical History" },
      { key: "current_health_condition", label: "Current Health Condition" },
      { key: "family_medical_history", label: "Family Medical History" },
      { key: "smoking_alcohol_habits", label: "Smoking / Alcohol Habits" },
      { key: "height_cm", label: "Height (cm)" },
      { key: "weight_kg", label: "Weight (kg)" },
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
