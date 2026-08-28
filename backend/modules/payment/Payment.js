const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  payment_id: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  transaction_utr: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  token_id: { 
    type: String, 
    required: true, 
    index: true 
  },
  farmer_aadhar: { 
    type: String, 
    required: true, 
    index: true 
  },
  farmer_name: { 
    type: String, 
    required: true 
  },
  farmer_phone: { 
    type: String, 
    required: true 
  },
  crop_type: { 
    type: String, 
    required: true 
  },
  net_weight_quintals: { 
    type: Number, 
    required: true 
  },
  msp_rate: { 
    type: Number, 
    required: true 
  },
  gross_amount: { 
    type: Number, 
    required: true 
  },
  bank_account_number: { 
    type: String, 
    required: true 
  },
  bank_ifsc: { 
    type: String, 
    required: true 
  },
  bank_name: { 
    type: String, 
    default: 'State Bank of India' 
  },
  j_form_number: { 
    type: String, 
    required: true 
  },
  payment_status: { 
    type: String, 
    enum: ['PENDING_APPROVAL', 'PROCESSING_PFMS', 'PAID', 'FAILED'], 
    default: 'PAID' 
  },
  pfms_batch_id: { 
    type: String, 
    default: 'PFMS-2026-BATCH-09' 
  },
  disbursed_at: { 
    type: Date, 
    default: Date.now 
  },
  approved_by: { 
    type: String, 
    default: 'Mandi Accounts Officer' 
  },
  created_at: { 
    type: Date, 
    default: Date.now 
  },
  updated_at: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('Payment', paymentSchema);
