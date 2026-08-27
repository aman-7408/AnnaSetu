const express = require('express');
const router = express.Router();
const Farmer = require('./Farmer');

const mockAadharDatabase = {
  '111122223333': {
    name: 'Aman Kumar',
    phone: '9876543210',
    gender: 'Male',
    address: 'House 42, Gram Panchayat, District XYZ, State',
    linked_bank_accounts: ['000012345678']
  }
};

router.get('/', async (req, res) => {
  try {
    const farmers = await Farmer.find().sort({ registered_at: -1 });
    res.json({ success: true, count: farmers.length, farmers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/send-otp', (req, res) => {
  const { aadhar_number } = req.body;
  if (!aadhar_number || aadhar_number.length !== 12) {
    return res.status(400).json({ error: 'Please enter a valid 12-digit Aadhar number.' });
  }
  res.json({ message: 'OTP successfully sent to Aadhar-linked mobile number.' });
});

router.post('/verify-otp', (req, res) => {
  const { aadhar_number, otp } = req.body;
  
  if (otp !== '123456') {
    return res.status(400).json({ error: 'Invalid OTP.' });
  }

  const farmerData = mockAadharDatabase[aadhar_number];
  if (!farmerData) {
    return res.status(404).json({ error: 'Aadhar number not found in citizen database.' });
  }

  res.json({ 
    message: 'Aadhar Verified Successfully.',
    autoFillData: {
      name: farmerData.name,
      phone: farmerData.phone,
      gender: farmerData.gender,
      address: farmerData.address
    }
  });
});

router.post('/register', async (req, res) => {
  try {
    const { aadhar_number, bank_account_number } = req.body;
    
    const farmerData = mockAadharDatabase[aadhar_number];
    if (!farmerData) {
      return res.status(400).json({ error: 'Invalid Aadhar.' });
    }

    if (!farmerData.linked_bank_accounts.includes(bank_account_number)) {
      return res.status(400).json({ 
        error: 'The bank account details you provided are not linked with your Aadhar. Kindly add a valid bank account.' 
      });
    }

    const existingFarmer = await Farmer.findOne({ aadhar_number });
    if (existingFarmer) {
      return res.status(400).json({ error: 'Farmer with this Aadhar is already registered in AnnaSetu.' });
    }

    const newFarmer = new Farmer(req.body);
    await newFarmer.save();

    res.status(201).json({ message: 'Farmer successfully registered!', farmer: newFarmer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
