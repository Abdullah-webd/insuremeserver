import submit_registration from "../functions/submit_registration.js";
import submit_claim from "../functions/submit_claim.js";
import submit_car_insurance_application from "../functions/submit_car_insurance_application.js";
import submit_house_insurance_application from "../functions/submit_house_insurance_application.js";
import submit_health_insurance_application from "../functions/submit_health_insurance_application.js";
import submit_life_insurance_application from "../functions/submit_life_insurance_application.js";


const functionMap = {
  submit_registration,
  submit_claim,
  submit_car_insurance_application,
  submit_house_insurance_application,
  submit_health_insurance_application,
  submit_life_insurance_application,

};

export async function runFunctionByName(name, payload) {
  const fn = functionMap[name];
  if (!fn) throw new Error(`Unknown function: ${name}`);
  return fn(payload);
}
