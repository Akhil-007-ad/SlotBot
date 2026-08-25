import dotenv from 'dotenv';
import dns from 'node:dns';
import mongoose from 'mongoose';
import Room from './models/Room.js';

dotenv.config();
dns.setServers(['1.1.1.1', '8.8.8.8']);

const ROOMS_DATA = [
  // ── 4th Floor, FD-GDC, Hyderabad ──────────────────────────────────────────
  {
    name: 'Vista',
    outlookEmail: 'Vista@techwave.com',
    location: 'FD-GDC, Hyderabad, India',
    floor: '4th floor',
    roomType: 'Conference Room',
    sittingCapacity: 6,
    tvAvailability: false,
    minBookingHours: 0.5,
    maxBookingHours: 2,
    authorizedRoles: ['Everyone']
  },
  {
    name: 'Galaxy',
    outlookEmail: 'Galaxy@techwave.com',
    location: 'FD-GDC, Hyderabad, India',
    floor: '4th floor',
    roomType: 'Conference Room',
    sittingCapacity: 8,
    tvAvailability: true,
    minBookingHours: 0.5,
    maxBookingHours: 2,
    authorizedRoles: ['Everyone']
  },
  {
    name: 'Atlas',
    outlookEmail: 'Atlas@techwave.com',
    location: 'FD-GDC, Hyderabad, India',
    floor: '4th floor',
    roomType: 'Discussion Room',
    sittingCapacity: 4,
    tvAvailability: false,
    minBookingHours: 0.5,
    maxBookingHours: 2,
    authorizedRoles: ['Everyone']
  },
  {
    name: 'Cosmos',
    outlookEmail: 'Cosmos@techwave.com',
    location: 'FD-GDC, Hyderabad, India',
    floor: '4th floor',
    roomType: 'Conference Room',
    sittingCapacity: 6,
    tvAvailability: false,
    minBookingHours: 0.5,
    maxBookingHours: 2,
    authorizedRoles: ['Everyone']
  },
  {
    name: 'Phoenix',
    outlookEmail: 'Phoenix@techwave.com',
    location: 'FD-GDC, Hyderabad, India',
    floor: '4th floor',
    roomType: 'Conference Room',
    sittingCapacity: 8,
    tvAvailability: true,
    minBookingHours: 0.5,
    maxBookingHours: 2,
    authorizedRoles: ['Everyone']
  },
  {
    name: 'Quest',
    outlookEmail: 'Quest@techwave.com',
    location: 'FD-GDC, Hyderabad, India',
    floor: '4th floor',
    roomType: 'Training Room',
    sittingCapacity: 50,
    tvAvailability: true,
    minBookingHours: 0.5,
    maxBookingHours: 8,
    authorizedRoles: ['IT', 'Admin', 'HR', 'L&D']
  },
  {
    name: 'Vega',
    outlookEmail: 'Vega@techwave.com',
    location: 'FD-GDC, Hyderabad, India',
    floor: '4th floor',
    roomType: 'Conference Room',
    sittingCapacity: 8,
    tvAvailability: true,
    minBookingHours: 0.5,
    maxBookingHours: 2,
    authorizedRoles: ['Everyone']
  },

  // ── 5th Floor, FD-GDC, Hyderabad ──────────────────────────────────────────
  {
    name: 'Prime',
    outlookEmail: 'Prime@techwave.com',
    location: 'FD-GDC, Hyderabad, India',
    floor: '5th floor',
    roomType: 'Board Room',
    sittingCapacity: 10,
    tvAvailability: true,
    minBookingHours: 0.5,
    maxBookingHours: 8,
    authorizedRoles: ['IT', 'Admin', 'Finance', 'Management']
  },
  {
    name: 'Pinnacle',
    outlookEmail: 'Pinnacle@techwave.com',
    location: 'FD-GDC, Hyderabad, India',
    floor: '5th floor',
    roomType: 'Board Room',
    sittingCapacity: 20,
    tvAvailability: true,
    minBookingHours: 0.5,
    maxBookingHours: 8,
    authorizedRoles: ['IT', 'Admin', 'HR', 'Management']
  },
  {
    name: 'Nova',
    outlookEmail: 'Nova@techwave.com',
    location: 'FD-GDC, Hyderabad, India',
    floor: '5th floor',
    roomType: 'Conference Room',
    sittingCapacity: 8,
    tvAvailability: true,
    minBookingHours: 0.5,
    maxBookingHours: 2,
    authorizedRoles: ['Everyone']
  },
  {
    name: 'Beacon',
    outlookEmail: 'Beacon@techwave.com',
    location: 'FD-GDC, Hyderabad, India',
    floor: '5th floor',
    roomType: 'Discussion Room',
    sittingCapacity: 4,
    tvAvailability: false,
    minBookingHours: 0.5,
    maxBookingHours: 2,
    authorizedRoles: ['Everyone']
  },
  {
    name: 'Mercury',
    outlookEmail: 'Mercury@techwave.com',
    location: 'FD-GDC, Hyderabad, India',
    floor: '5th floor',
    roomType: 'Discussion Room',
    sittingCapacity: 4,
    tvAvailability: false,
    minBookingHours: 0.5,
    maxBookingHours: 2,
    authorizedRoles: ['Everyone']
  },
  {
    name: 'Alpha',
    outlookEmail: 'Alpha@techwave.com',
    location: 'FD-GDC, Hyderabad, India',
    floor: '5th floor',
    roomType: 'Discussion Room',
    sittingCapacity: 4,
    tvAvailability: false,
    minBookingHours: 0.5,
    maxBookingHours: 2,
    authorizedRoles: ['Everyone']
  },
  {
    name: 'Titan',
    outlookEmail: 'Titan@techwave.com',
    location: 'FD-GDC, Hyderabad, India',
    floor: '5th floor',
    roomType: 'Conference Room',
    sittingCapacity: 8,
    tvAvailability: true,
    minBookingHours: 0.5,
    maxBookingHours: 2,
    authorizedRoles: ['Everyone']
  },
  {
    name: 'Zenith',
    outlookEmail: 'Zenith@techwave.com',
    location: 'FD-GDC, Hyderabad, India',
    floor: '5th floor',
    roomType: 'Conference Room',
    sittingCapacity: 6,
    tvAvailability: true,
    minBookingHours: 0.5,
    maxBookingHours: 2,
    authorizedRoles: ['Everyone']
  },
  {
    name: 'Orion',
    outlookEmail: 'Orion.room@techwave.com',
    location: 'FD-GDC, Hyderabad, India',
    floor: '5th floor',
    roomType: 'Conference Room',
    sittingCapacity: 6,
    tvAvailability: false,
    minBookingHours: 0.5,
    maxBookingHours: 2,
    authorizedRoles: ['Everyone']
  },
  {
    name: 'Orbit',
    outlookEmail: 'Orbit@techwave.com',
    location: 'FD-GDC, Hyderabad, India',
    floor: '5th floor',
    roomType: 'Training Room',
    sittingCapacity: 20,
    tvAvailability: true,
    minBookingHours: 0.5,
    maxBookingHours: 8,
    authorizedRoles: ['IT', 'Admin', 'HR', 'L&D']
  },
  {
    name: 'Horizon',
    outlookEmail: 'Horizon@techwave.com',
    location: 'FD-GDC, Hyderabad, India',
    floor: '5th floor',
    roomType: 'Conference Room',
    sittingCapacity: 8,
    tvAvailability: true,
    minBookingHours: 0.5,
    maxBookingHours: 2,
    authorizedRoles: ['Everyone']
  },

  // ── 4th Floor, GDC, Hyderabad ──────────────────────────────────────────────
  {
    name: 'Hercules',
    outlookEmail: 'Hercules@techwave.com',
    location: 'GDC, Hyderabad, India',
    floor: '4th floor',
    roomType: 'Conference Room',
    sittingCapacity: 6,
    tvAvailability: true,
    minBookingHours: 0.5,
    maxBookingHours: 2,
    authorizedRoles: ['Everyone']
  },
  {
    name: 'Apollo',
    outlookEmail: 'Apollo@techwave.com',
    location: 'GDC, Hyderabad, India',
    floor: '4th floor',
    roomType: 'Board Room',
    sittingCapacity: 14,
    tvAvailability: true,
    minBookingHours: 0.5,
    maxBookingHours: 8,
    authorizedRoles: ['IT', 'Admin', 'HR', 'Management']
  },
  {
    name: 'Pluto',
    outlookEmail: 'Pluto@techwave.com',
    location: 'GDC, Hyderabad, India',
    floor: '4th floor',
    roomType: 'Conference Room',
    sittingCapacity: 8,
    tvAvailability: true,
    minBookingHours: 0.5,
    maxBookingHours: 2,
    authorizedRoles: ['Everyone']
  }
];

const seedRooms = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    let inserted = 0;
    let updated = 0;

    for (const roomData of ROOMS_DATA) {
      const result = await Room.findOneAndUpdate(
        { name: roomData.name },
        { $set: roomData },
        { upsert: true, new: true, runValidators: true }
      );
      if (result.createdAt?.getTime() === result.updatedAt?.getTime()) {
        inserted++;
      } else {
        updated++;
      }
    }

    const total = await Room.countDocuments();
    console.log(`\n🎉 Seeding complete!`);
    console.log(`   📥 Inserted : ${inserted}`);
    console.log(`   🔄 Updated  : ${updated}`);
    console.log(`   🗂️  Total rooms in DB: ${total}`);

    // Print a summary table
    const rooms = await Room.find({}, 'name floor location roomType sittingCapacity authorizedRoles').sort({ floor: 1, name: 1 });
    console.log('\n📋 Room Summary:');
    console.log('─'.repeat(90));
    console.log(`${'Name'.padEnd(12)} ${'Floor'.padEnd(10)} ${'Type'.padEnd(17)} ${'Cap'.padEnd(5)} ${'Authorized'}`);
    console.log('─'.repeat(90));
    for (const r of rooms) {
      console.log(
        `${r.name.padEnd(12)} ${r.floor.padEnd(10)} ${r.roomType.padEnd(17)} ${String(r.sittingCapacity).padEnd(5)} ${r.authorizedRoles.join(', ')}`
      );
    }
    console.log('─'.repeat(90));

  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB. Done.');
  }
};

seedRooms();
