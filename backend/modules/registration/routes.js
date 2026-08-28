const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Farmer = require('./Farmer');
const AadharCitizen = require('../aadhar/AadharCitizen');

// GET all registered farmers in AnnaSetu
router.get('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const farmers = await Farmer.find().sort({ registered_at: -1 });
      return res.json({ success: true, count: farmers.length, farmers });
    }
    return res.json({ success: true, count: 0, farmers: [] });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// 1. STEP 1: SEND OTP (Validates Aadhaar in official AadharCitizen Database)
router.post('/send-otp', async (req, res) => {
  const { aadhar_number } = req.body;
  if (!aadhar_number || aadhar_number.length !== 12 || !/^\d{12}$/.test(aadhar_number)) {
    return res.status(400).json({ error: 'Please enter a valid 12-digit Aadhar number.' });
  }

  try {
    // 1. Verify existence in government AadharCitizen database collection
    const citizen = await AadharCitizen.findOne({ aadhar_number });
    if (!citizen) {
      return res.status(404).json({ 
        error: 'Aadhar number not found in UIDAI citizen database. Please enter a valid registered Aadhar.' 
      });
    }

    // 2. Check if already registered in AnnaSetu
    if (mongoose.connection.readyState === 1) {
      const existingFarmer = await Farmer.findOne({ aadhar_number });
      if (existingFarmer) {
        return res.status(409).json({
          already_registered: true,
          error: `Aadhaar ${aadhar_number} is already registered under the name "${existingFarmer.name}".`,
          farmer_name: existingFarmer.name
        });
      }
    }

    res.json({ success: true, message: 'OTP successfully sent to Aadhar-linked mobile number.' });
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ error: 'Database verification failed.' });
  }
});

// 2. STEP 1: VERIFY OTP (Retrieves verified citizen KYC details from MongoDB)
router.post('/verify-otp', async (req, res) => {
  const { aadhar_number, otp } = req.body;
  
  if (otp !== '123456') {
    return res.status(400).json({ error: 'Invalid OTP.' });
  }

  try {
    const citizen = await AadharCitizen.findOne({ aadhar_number });
    if (!citizen) {
      return res.status(404).json({ error: 'Aadhar number not found in citizen database.' });
    }

    res.json({ 
      success: true,
      message: 'Aadhar Verified Successfully.',
      autoFillData: {
        name: citizen.name,
        phone: citizen.phone,
        gender: citizen.gender,
        address: citizen.address
      }
    });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Failed to verify Aadhar with citizen database.' });
  }
});

// 3. STEP 2: COMPLETE REGISTRATION (Saves verified farmer to AnnaSetu)
router.post('/register', async (req, res) => {
  try {
    const { aadhar_number, bank_account_number } = req.body;
    
    if (!aadhar_number || aadhar_number.length !== 12 || !/^\d{12}$/.test(aadhar_number)) {
      return res.status(400).json({ error: 'Invalid Aadhar format. Must be exactly 12 digits.' });
    }

    // Cross-verify with AadharCitizen database
    const citizen = await AadharCitizen.findOne({ aadhar_number });
    if (!citizen) {
      return res.status(400).json({ error: 'Invalid Aadhar. Not found in citizen database.' });
    }

    // Verify linked bank accounts
    if (citizen.linked_bank_accounts && citizen.linked_bank_accounts.length > 0 && !citizen.linked_bank_accounts.includes(bank_account_number)) {
      return res.status(400).json({ 
        error: 'The bank account details you provided are not linked with your Aadhar. Kindly add a valid bank account.' 
      });
    }

    if (mongoose.connection.readyState === 1) {
      const newFarmer = new Farmer(req.body);
      await newFarmer.save();

      return res.status(201).json({ success: true, message: 'Farmer successfully registered!', farmer: newFarmer });
    } else {
      return res.status(500).json({ error: 'Database connection offline.' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
