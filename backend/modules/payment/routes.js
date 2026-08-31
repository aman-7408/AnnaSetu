const express = require('express');
const router = express.Router();
const Payment = require('./Payment');
const Farmer = require('../registration/Farmer');
const Notification = require('../notifications/Notification');

function generateUTR() {
  const random = Math.floor(100000 + Math.random() * 900000);
  return `UTR-2026-PFMS-${random}`;
}

function generatePaymentId() {
  const random = Math.floor(1000 + Math.random() * 9000);
  return `PMT-2026-${random}`;
}

// 1. GET ALL PAYMENTS FOR A SPECIFIC FARMER (BY AADHAAR)
router.get('/farmer/:aadhar', async (req, res) => {
  try {
    const { aadhar } = req.params;
    if (!aadhar) {
      return res.status(400).json({ error: 'Farmer Aadhaar is required.' });
    }

    const payments = await Payment.find({ farmer_aadhar: aadhar.trim() }).sort({ disbursed_at: -1 });
    
    // Compute total disbursed amount
    const totalDisbursed = payments
      .filter(p => p.payment_status === 'PAID')
      .reduce((sum, p) => sum + (p.gross_amount || 0), 0);

    res.json({
      success: true,
      count: payments.length,
      total_disbursed: totalDisbursed,
      payments
    });
  } catch (err) {
    console.error('Error fetching farmer payments:', err);
    res.status(500).json({ error: 'Failed to fetch payment records.' });
  }
});

// 2. GET SINGLE PAYMENT BY TOKEN ID
router.get('/token/:tokenId', async (req, res) => {
  try {
    const { tokenId } = req.params;
    const payment = await Payment.findOne({ token_id: tokenId });
    if (!payment) {
      return res.status(404).json({ error: `Payment for Token ${tokenId} not found.` });
    }
    res.json({ success: true, payment });
  } catch (err) {
    console.error('Error fetching payment by token:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 3. GET SINGLE PAYMENT RECEIPT VOUCHER BY PAYMENT ID
router.get('/receipt/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const payment = await Payment.findOne({ payment_id: paymentId });
    if (!payment) {
      return res.status(404).json({ error: 'Payment voucher not found.' });
    }
    res.json({ success: true, payment });
  } catch (err) {
    console.error('Error fetching receipt:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 4. CREATE OR SYNC PAYMENT FROM COMPLETED STAGE 5 PROCUREMENT
router.post('/create-from-procurement', async (req, res) => {
  try {
    const {
      token_id,
      farmer_aadhar,
      farmer_name,
      farmer_phone,
      crop_type,
      net_weight_quintals,
      msp_rate,
      j_form_number
    } = req.body;

    if (!token_id || !farmer_aadhar) {
      return res.status(400).json({ error: 'Token ID and Farmer Aadhaar are required.' });
    }

    const weight = Number(net_weight_quintals) || 45.20;
    const rate = Number(msp_rate) || 2275;
    const grossAmount = Math.round(weight * rate);

    // Fetch verified bank details from Farmer database
    const farmer = await Farmer.findOne({ aadhar_number: farmer_aadhar });
    if (!farmer) return res.status(404).json({ error: 'Farmer profile not found for this Aadhaar' });
    const bankAccount = farmer.bank_account_number;
    const bankIfsc = farmer.bank_ifsc;

    let payment = await Payment.findOne({ token_id });

    if (payment) {
      payment.gross_amount = grossAmount;
      payment.net_weight_quintals = weight;
      payment.msp_rate = rate;
      payment.j_form_number = j_form_number || payment.j_form_number;
      payment.payment_status = 'PAID';
      payment.disbursed_at = new Date();
      payment.updated_at = new Date();
      await payment.save();
    } else {
      payment = new Payment({
        payment_id: generatePaymentId(),
        transaction_utr: generateUTR(),
        token_id,
        farmer_aadhar,
        farmer_name: farmer_name || farmer.name,
        farmer_phone: farmer_phone || farmer.phone,
        crop_type: crop_type,
        net_weight_quintals: weight,
        msp_rate: rate,
        gross_amount: grossAmount,
        bank_account_number: bankAccount,
        bank_ifsc: bankIfsc,
        bank_name: 'Linked Bank Account',
        j_form_number: j_form_number,
        payment_status: 'PAID',
        disbursed_at: new Date()
      });
      await payment.save();
    }

    // Trigger Notification for the farmer
    await Notification.create({
      farmer_id: farmer_aadhar,
      title: '₹ DBT Payment Disbursed to Bank',
      message: `Direct Benefit Transfer of ₹${grossAmount.toLocaleString('en-IN')} successfully credited to A/C ending in ...${bankAccount.slice(-4)} (UTR: ${payment.transaction_utr}, J-Form #${payment.j_form_number}).`,
      category: 'payment',
      trigger_event: 'payment_initiated',
      action_hint: 'View official digital payment voucher and download receipt.',
      metadata: {
        token_id,
        payment_id: payment.payment_id,
        transaction_utr: payment.transaction_utr,
        amount: grossAmount,
        j_form: payment.j_form_number
      }
    });

    res.status(201).json({ success: true, message: 'DBT Payment Disbursed', payment });
  } catch (err) {
    console.error('Error creating payment:', err);
    res.status(500).json({ error: 'Failed to create payment record.' });
  }
});

// 5. GET ALL PAYMENTS (FOR TREASURY OVERVIEW)
router.get('/all', async (req, res) => {
  try {
    const payments = await Payment.find().sort({ disbursed_at: -1 }).limit(100);
    res.json({ success: true, count: payments.length, payments });
  } catch (err) {
    console.error('Error fetching all payments:', err);
    res.status(500).json({ error: 'Failed to fetch payments.' });
  }
});

module.exports = router;
