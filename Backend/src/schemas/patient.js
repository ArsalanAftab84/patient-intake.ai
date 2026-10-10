const { z } = require('zod');

const isPastDate = (dateString) => {
  const today = new Date();
  const dateToVerify = new Date(dateString);
  return dateToVerify <= today;
};

const patientSchema = z.object({
  first_name: z.string()
    .min(1).max(50)
    .regex(/^[a-zA-Z\-' ]+$/, 'Only alphabetic characters, hyphens, and apostrophes allowed'),
  last_name: z.string()
    .min(1).max(50)
    .regex(/^[a-zA-Z\-' ]+$/, 'Only alphabetic characters, hyphens, and apostrophes allowed'),
  date_of_birth: z.string()
    .regex(/^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/, 'DOB must be MM/DD/YYYY')
    .refine(isPastDate, { message: 'Date of birth cannot be in the future' }),
  sex: z.enum(['Male', 'Female', 'Other', 'Decline to Answer']),
  phone_number: z.string()
    .regex(/^\d{10}$/, 'Must be a valid 10-digit U.S. phone number'),
  email: z.string().email().optional().or(z.literal('')),
  address_line_1: z.string().min(1),
  address_line_2: z.string().optional().or(z.literal('')),
  city: z.string().min(1).max(100),
  state: z.string().length(2, 'State must be a 2-letter abbreviation'),
  zip_code: z.string().regex(/^\d{5}(-\d{4})?$/, 'Must be a 5-digit or ZIP+4 format'),
  insurance_provider: z.string().optional().or(z.literal('')),
  insurance_member_id: z.string().regex(/^[a-zA-Z0-9]*$/, 'Alphanumeric only').optional().or(z.literal('')),
  preferred_language: z.string().default('English'),
  emergency_contact_name: z.string().optional().or(z.literal('')),
  emergency_contact_phone: z.string()
    .regex(/^\d{10}$/, 'Must be a valid 10-digit U.S. phone number')
    .optional().or(z.literal(''))
});

module.exports = { patientSchema };