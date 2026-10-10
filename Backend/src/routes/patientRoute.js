const express = require('express');
const {
  createPatient,
  getPatients,
  getPatientById,
  updatePatient,
  deletePatient,
  checkPatient
} = require('../controllers/patientController');
const router = express.Router();

router.post('/', createPatient);
router.post('/check', checkPatient);
router.get('/', getPatients);
router.get('/:id', getPatientById);
router.put('/:id', updatePatient);
router.delete('/:id', deletePatient);

module.exports = router;