const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Farmer = require('./Farmer');

const mockAadharDatabase = {
  '111122223333': {
    name: 'Aman Kumar',
    phone: '9876543210',
    gender: 'Male',
    address: 'House 42, Gram Panchayat, District XYZ, State',
    linked_bank_accounts: ['000012345678']
  },
  '123456789012': {
    name: 'Aman Kumar',
    phone: '9876543210',
    gender: 'Male',
    address: 'Ludhiana Rural, Punjab',
    linked_bank_accounts: ['000012345678', '998877665544']
  },
  '987654321098': {
    name: 'Ramesh Patel',
    phone: '9412355678',
    gender: 'Male',
    address: 'Bypass Sector 4, Meerut, UP',
    linked_bank_accounts: ['112233445566']
  },
  '456789012345': {
    name: 'Sunita Devi',
    phone: '9835099881',
    gender: 'Female',
    address: 'Kamrup District, Guwahati, Assam',
    linked_bank_accounts: ['556677889900']
  }
};

const inMemoryFarmers = [
  {
    name: 'Aman Kumar',
    aadhar_number: '123456789012',
    phone: '9876543210',
    gender: 'Male',
    address: 'Ludhiana Rural, Punjab',
    bank_account_number: '000012345678',
    land_size: '5.5 Acres',
    plot_number: 'PL-784/A',
    registered_at: new Date()
  },
  {
    name: 'Ramesh Patel',
    aadhar_number: '987654321098',
    phone: '9412355678',
    gender: 'Male',
    address: 'Bypass Sector 4, Meerut, UP',
    bank_account_number: '112233445566',
    land_size: '3.8 Acres',
    plot_number: 'UP-MR-209',
    registered_at: new Date()
  }
];

router.get('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const farmers = await Farmer.find().sort({ registered_at: -1 });
      return res.json({ success: true, count: farmers.length, farmers });
    }
    return res.json({ success: true, count: inMemoryFarmers.length, farmers: inMemoryFarmers });
  } catch (error) {
    return res.json({ success: true, count: inMemoryFarmers.length, farmers: inMemoryFarmers });
  }
});

router.post('/send-otp', (req, res) => {
  const { aadhar_number } = req.body;
  if (!aadhar_number || aadhar_number.length !== 12 || !/^\d{12}$/.test(aadhar_number)) {
    return res.status(400).json({ error: 'Please enter a valid 12-digit Aadhar number.' });
  }
  res.json({ success: true, message: 'OTP successfully sent to Aadhar-linked mobile number.' });
});

router.post('/verify-otp', (req, res) => {
  const { aadhar_number, otp } = req.body;
  
  if (otp !== '123456') {
    return res.status(400).json({ error: 'Invalid OTP.' });
  }

  const farmerData = mockAadharDatabase[aadhar_number] || {
    name: 'Verified Kisan Beneficiary',
    phone: '9876543210',
    gender: 'Male',
    address: 'Rural Farming Cluster, India',
    linked_bank_accounts: ['000012345678', '998877665544', '112233445566']
  };

  res.json({ 
    success: true,
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
    
    if (!aadhar_number || aadhar_number.length !== 12 || !/^\d{12}$/.test(aadhar_number)) {
      return res.status(400).json({ error: 'Invalid Aadhar format. Must be exactly 12 digits.' });
    }

    const farmerData = mockAadharDatabase[aadhar_number] || {
      linked_bank_accounts: ['000012345678', '998877665544', '112233445566', bank_account_number]
    };

    if (farmerData.linked_bank_accounts && !farmerData.linked_bank_accounts.includes(bank_account_number)) {
      return res.status(400).json({ 
        error: 'The bank account details you provided are not linked with your Aadhar. Kindly add a valid bank account.' 
      });
    }

    if (mongoose.connection.readyState === 1) {
      const existingFarmer = await Farmer.findOne({ aadhar_number });
      if (existingFarmer) {
        return res.status(400).json({ error: 'Farmer with this Aadhar is already registered in AnnaSetu.' });
      }

      const newFarmer = new Farmer(req.body);
      await newFarmer.save();

      return res.status(201).json({ success: true, message: 'Farmer successfully registered!', farmer: newFarmer });
    } else {
      const exists = inMemoryFarmers.some(f => f.aadhar_number === aadhar_number);
      if (exists) {
        return res.status(400).json({ error: 'Farmer with this Aadhar is already registered in AnnaSetu.' });
      }

      const newFarmer = {
        ...req.body,
        _id: 'local_' + Date.now(),
        registered_at: new Date()
      };
      inMemoryFarmers.unshift(newFarmer);

      return res.status(201).json({ 
        success: true,
        message: 'Farmer successfully registered!', 
        farmer: newFarmer 
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
