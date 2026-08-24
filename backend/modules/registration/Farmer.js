const mongoose = require('mongoose');

const farmerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  gender: { type: String, required: true },
  address: { type: String, required: true },
  aadhar_number: { type: String, required: true, unique: true },
  
  land_size: { type: String, required: true },
  plot_number: { type: String, required: true },
  land_address: { type: String, required: true },
  
  bank_account_number: { type: String, required: true },
  bank_ifsc: { type: String, required: true },
  registered_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Farmer', farmerSchema);
