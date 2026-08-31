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

    res.json({ 
      success: true, 
      message: 'OTP successfully sent to Aadhar-linked mobile number.',
      otp: '123456'
    });
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ error: 'Database verification failed.' });
  }
});

// 2. STEP 1: VERIFY OTP (Retrieves verified citizen KYC details from MongoDB)
router.post('/verify-otp', async (req, res) => {
  const { aadhar_number, otp } = req.body;
  
  if (!/^\d{6}$/.test(otp)) {
    return res.status(400).json({ error: 'Invalid OTP format. Must be 6 digits.' });
  }

  if (otp !== '123456') {
    return res.status(400).json({ error: 'Incorrect OTP. Please enter valid test OTP 123456.' });
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
    const { aadhar_number, bank_account_number, land_size } = req.body;
    
    if (!aadhar_number || aadhar_number.length !== 12 || !/^\d{12}$/.test(aadhar_number)) {
      return res.status(400).json({ error: 'Invalid Aadhar format. Must be exactly 12 digits.' });
    }

    if (!land_size || isNaN(parseFloat(land_size)) || parseFloat(land_size) <= 0) {
      return res.status(400).json({ error: 'Invalid land size. Please enter a valid positive number.' });
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

// 4. STEP 4: FARMER LOGIN - SEND OTP (Requires existing registration in AnnaSetu)
router.post('/login/send-otp', async (req, res) => {
  const { aadhar_number } = req.body;
  if (!aadhar_number || aadhar_number.length !== 12 || !/^\d{12}$/.test(aadhar_number)) {
    return res.status(400).json({ error: 'Please enter a valid 12-digit Aadhaar number.' });
  }

  try {
    const farmer = await Farmer.findOne({ aadhar_number });
    if (!farmer) {
      return res.status(404).json({
        error: 'This Aadhaar number is not registered in AnnaSetu. Please complete your farmer registration first.'
      });
    }

    res.json({
      success: true,
      message: 'OTP sent successfully to registered mobile number.',
      farmer_name: farmer.name,
      masked_phone: farmer.phone ? `••••••${farmer.phone.slice(-4)}` : '••••••',
      otp: '123456'
    });
  } catch (err) {
    console.error('Farmer login send OTP error:', err);
    res.status(500).json({ error: 'Server error during login authentication.' });
  }
});

// 5. STEP 5: FARMER LOGIN - VERIFY OTP (Returns full authenticated farmer profile)
router.post('/login/verify-otp', async (req, res) => {
  const { aadhar_number, otp } = req.body;

  if (!/^\d{6}$/.test(otp)) {
    return res.status(400).json({ error: 'Invalid OTP format. Must be 6 digits.' });
  }

  if (otp !== '123456') {
    return res.status(400).json({ error: 'Incorrect OTP. Please enter valid test OTP 123456.' });
  }

  try {
    const farmer = await Farmer.findOne({ aadhar_number });
    if (!farmer) {
      return res.status(404).json({ error: 'Farmer profile not found in AnnaSetu registry.' });
    }

    res.json({
      success: true,
      message: `Welcome back, ${farmer.name}!`,
      farmer
    });
  } catch (err) {
    console.error('Farmer login verify OTP error:', err);
    res.status(500).json({ error: 'Server error during OTP verification.' });
  }
});

module.exports = router;
