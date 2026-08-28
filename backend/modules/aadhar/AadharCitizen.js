const mongoose = require('mongoose');

const aadharCitizenSchema = new mongoose.Schema({
  aadhar_number: { 
    type: String, 
    required: true, 
    unique: true,
    index: true
  },
  name: { 
    type: String, 
    required: true 
  },
  phone: { 
    type: String, 
    required: true 
  },
  gender: { 
    type: String, 
    default: 'Male' 
  },
  address: { 
    type: String, 
    required: true 
  },
  linked_bank_accounts: [
    { type: String }
  ],
  created_at: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('AadharCitizen', aadharCitizenSchema);
