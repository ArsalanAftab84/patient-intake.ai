const { supabase } = require('../config/supabase');
const { patientSchema } = require('../schemas/patient');

/** @param {unknown} data @param {unknown} [error] */
const formatResponse = (data, error = null) => ({ data, error });

/** @param {Array<{ message: string }>} issues */
const getValidationMessage = (issues) =>
  issues.map((issue) => issue.message).join(', ');

/** @param {{ body?: any }} req */
function getToolCall(req) {
  return req.body?.message?.toolCalls?.[0]
    || req.body?.message?.toolCallList?.[0]
    || null;
}

/** @param {any} req @param {any} toolCall */
function getToolPayload(req, toolCall) {
  if (!toolCall) return req.body;

  const args = toolCall.function?.arguments ?? toolCall.arguments ?? {};
  return typeof args === 'string' ? JSON.parse(args) : args;
}

// POST /patients
/** @param {any} req @param {any} res */
async function createPatient(req, res) {
  try {
    const toolCall = getToolCall(req);
    const payload = getToolPayload(req, toolCall);

    const validation = patientSchema.safeParse(payload);
    if (!validation.success) {
      const errorMessage = getValidationMessage(validation.error.issues);

      if (toolCall) {
        return res.status(200).json({
          results: [{ toolCallId: toolCall.id, error: errorMessage }]
        });
      }

      return res.status(422).json(formatResponse(null, errorMessage));
    }

    const { data, error } = await supabase
      .from('patients')
      .insert([validation.data])
      .select()
      .single();

    if (error) {
      console.error('Supabase patient insert failed:', error);
      return res.status(500).json(formatResponse(null, 'Failed to create patient'));
    }

    if (toolCall) {
      return res.status(200).json({
        results: [{
          toolCallId: toolCall.id,
          result: `Success. Patient ID is ${data.patient_id}`
        }]
      });
    }

    return res.status(201).json(formatResponse(data));
  } catch (err) {
    console.error('Error creating patient:', err);
    return res.status(500).json(formatResponse(null, 'Internal server error'));
  }
}

// GET /patients
/** @param {any} req @param {any} res */
async function getPatients(req, res) {
  try {
    let query = supabase
      .from('patients')
      .select('*')
      .is('deleted_at', null);

    if (req.query.last_name) query = query.ilike('last_name', req.query.last_name);
    if (req.query.date_of_birth) query = query.eq('date_of_birth', req.query.date_of_birth);
    if (req.query.phone_number) query = query.eq('phone_number', req.query.phone_number);

    const { data, error } = await query;
    if (error) throw error;

    const toolCall = getToolCall(req);
    if (toolCall) {
      const match = data.length > 0 ? data[0] : null;
      return res.status(200).json({
        results: [{
          toolCallId: toolCall.id,
          result: match ? JSON.stringify(match) : 'No record found.'
        }]
      });
    }

    return res.status(200).json(formatResponse(data));
  } catch (err) {
    console.error('Error fetching patients:', err);
    return res.status(500).json(formatResponse(null, 'Failed to retrieve patients'));
  }
}

// GET /patients/:id
/** @param {any} req @param {any} res */
async function getPatientById(req, res) {
  try {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('patient_id', req.params.id)
      .is('deleted_at', null)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return res.status(404).json(formatResponse(null, 'Patient not found'));

    return res.status(200).json(formatResponse(data));
  } catch (err) {
    console.error('Error fetching patient:', err);
    return res.status(500).json(formatResponse(null, 'Failed to retrieve patient'));
  }
}

// PUT /patients/:id
/** @param {any} req @param {any} res */
async function updatePatient(req, res) {
  try {
    const validation = patientSchema.partial().safeParse(req.body);
    if (!validation.success) {
      return res.status(422).json(
        formatResponse(null, getValidationMessage(validation.error.issues))
      );
    }

    const { data, error } = await supabase
      .from('patients')
      .update(validation.data)
      .eq('patient_id', req.params.id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return res.status(404).json(formatResponse(null, 'Patient not found'));

    return res.status(200).json(formatResponse(data));
  } catch (err) {
    console.error('Error updating patient:', err);
    return res.status(500).json(formatResponse(null, 'Failed to update patient'));
  }
}

// DELETE /patients/:id
/** @param {any} req @param {any} res */
async function deletePatient(req, res) {
  try {
    const { data, error } = await supabase
      .from('patients')
      .update({ deleted_at: new Date().toISOString() })
      .eq('patient_id', req.params.id)
      .is('deleted_at', null)
      .select('patient_id')
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return res.status(404).json(formatResponse(null, 'Patient not found'));

    return res.status(200).json(
      formatResponse({ message: 'Patient soft-deleted', patientId: data.patient_id })
    );
  } catch (err) {
    console.error('Error deleting patient:', err);
    return res.status(500).json(formatResponse(null, 'Failed to delete patient'));
  }
}

// POST /api/patients/check (Vapi Tool Webhook for Duplicate Check)
/** @param {any} req @param {any} res */
async function checkPatient(req, res) {
  try {
    const toolCall = getToolCall(req);
    const toolCallId = toolCall?.id || null;
    const payload = getToolPayload(req, toolCall);

    if (!payload.phone_number) {
      if (toolCallId) {
        return res.status(200).json({ results: [{ toolCallId, error: "Phone number is required." }] });
      }
      return res.status(400).json({ error: "Phone number is required" });
    }

    // Query Supabase for this phone number
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('phone_number', payload.phone_number)
      .is('deleted_at', null);

    if (error) throw error;

    const match = data.length > 0 ? data[0] : null;

    // Respond back to the Vapi Voice Agent
    if (toolCallId) {
      return res.status(200).json({
        results: [{ 
          toolCallId, 
          result: match ? `Record found: ${JSON.stringify(match)}` : "No record found." 
        }]
      });
    }

    return res.status(200).json(formatResponse(match));
  } catch (err) {
    console.error('Check patient error:', err);
    return res.status(500).json(formatResponse(null, 'Failed to check patient'));
  }
}

// MAKE SURE TO EXPORT IT AT THE BOTTOM:
module.exports = {
  createPatient,
  getPatients,
  getPatientById,
  updatePatient,
  deletePatient,
  checkPatient
};
