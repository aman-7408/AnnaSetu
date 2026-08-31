require('dotenv').config();
const mongoose = require('mongoose');
const AadharCitizen = require('./modules/aadhar/AadharCitizen');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  await AadharCitizen.deleteMany({});
  
  await AadharCitizen.create([
    {
      aadhar_number: '111122223333',
      name: 'Aman Kumar',
      phone: '9876543210',
      gender: 'Male',
      address: 'Chandwa,Ara, District Bhojpur, Bihar - 802312',
      linked_bank_accounts: ['000012345678', '998877665544']
    },
    {
      aadhar_number: '222233334444',
      name: 'Anusrita Deb',
      phone: '9123456789',
      gender: 'Female',
      address: 'Silchar, Assam - 788001',
      linked_bank_accounts: ['100023456789']
    },
    {
      aadhar_number: '333344445555',
      name: 'Anurag Ojha',
      phone: '9988776655',
      gender: 'Male',
      address: 'Lucknow, Uttar Pradesh - 226001',
      linked_bank_accounts: ['200034567890']
    }
  ]);
  console.log('Aadhar Citizens re-seeded!');
  process.exit(0);
});
