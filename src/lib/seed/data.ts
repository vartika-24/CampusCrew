// Static seed content: IIIT Allahabad campus points, hubs, operators and student roster.
export const PLACES = [
  { code: 'IIITA-G1', name: 'IIITA Main Gate (Gate 1)', kind: 'CAMPUS', city: 'Prayagraj', lat: 25.4285, lng: 81.7712 },
  { code: 'IIITA-BH', name: 'Boys Hostel Circle (BH-1 to BH-5)', kind: 'CAMPUS', city: 'Prayagraj', lat: 25.4300, lng: 81.7690 },
  { code: 'IIITA-GH', name: 'Girls Hostel Gate (GH-1 to GH-3)', kind: 'CAMPUS', city: 'Prayagraj', lat: 25.4318, lng: 81.7702 },
  { code: 'JHALWA', name: 'Jhalwa Crossing', kind: 'CAMPUS', city: 'Prayagraj', lat: 25.4340, lng: 81.7860 },
  { code: 'PRYJ', name: 'Prayagraj Junction (PRYJ)', kind: 'STATION', city: 'Prayagraj', lat: 25.4464, lng: 81.8301 },
  { code: 'SFG', name: 'Subedarganj Station (SFG)', kind: 'STATION', city: 'Prayagraj', lat: 25.4590, lng: 81.7990 },
  { code: 'IXD', name: 'Prayagraj Airport (IXD - Bamrauli)', kind: 'AIRPORT', city: 'Prayagraj', lat: 25.4401, lng: 81.7339 },
  { code: 'PRYG-CL', name: 'Civil Lines Bus Stand', kind: 'BUS', city: 'Prayagraj', lat: 25.4521, lng: 81.8392 },
  { code: 'CNB', name: 'Kanpur Central (CNB)', kind: 'STATION', city: 'Kanpur', lat: 26.4543, lng: 80.3503 },
  { code: 'NDLS', name: 'New Delhi (NDLS)', kind: 'STATION', city: 'New Delhi', lat: 28.6425, lng: 77.2194 },
  { code: 'KNP-HOME', name: 'Home Hub: Kakadeo Chauraha, Kanpur', kind: 'HOME_HUB', city: 'Kanpur', lat: 26.4730, lng: 80.3050 },
  { code: 'LKO', name: 'Lucknow Charbagh (LKO)', kind: 'STATION', city: 'Lucknow', lat: 26.8315, lng: 80.9209 },
] as const;

export const OPERATORS = [
  { name: 'Ramesh Yadav', plate: 'UP-70-GT-4821', vehicleType: 'SEDAN4', vehicleName: 'Maruti Dzire', phoneMasked: '+91 98XXX XX421', rating: 4.8 },
  { name: 'Sanjay Maurya', plate: 'UP-70-BN-2290', vehicleType: 'SEDAN4', vehicleName: 'Hyundai Aura', phoneMasked: '+91 94XXX XX290', rating: 4.7 },
  { name: 'Imran Ansari', plate: 'UP-70-CK-7713', vehicleType: 'SEDAN4', vehicleName: 'Swift Dzire', phoneMasked: '+91 99XXX XX713', rating: 4.6 },
  { name: 'Sunil Kushwaha', plate: 'UP-70-AT-3345', vehicleType: 'SEDAN4', vehicleName: 'Tata Tigor', phoneMasked: '+91 96XXX XX345', rating: 4.9 },
  { name: 'Vinod Patel', plate: 'UP-70-HT-1156', vehicleType: 'SUV6', vehicleName: 'Toyota Innova Crysta', phoneMasked: '+91 93XXX XX156', rating: 4.8 },
  { name: 'Dinesh Pandey', plate: 'UP-70-JK-6008', vehicleType: 'SUV6', vehicleName: 'Mahindra Marazzo', phoneMasked: '+91 97XXX XX008', rating: 4.5 },
  { name: 'Raju Nishad', plate: 'UP-70-RE-9021', vehicleType: 'AUTO', vehicleName: 'Bajaj RE Auto', phoneMasked: '+91 95XXX XX021', rating: 4.4 },
  { name: 'Mohan Lal', plate: 'UP-70-AU-5512', vehicleType: 'AUTO', vehicleName: 'Piaggio Ape Auto', phoneMasked: '+91 92XXX XX512', rating: 4.6 },
].map((o) => ({ ...o, badge: 'IIITA Licensed Operator · Police-verified' }));

type Gender = 'FEMALE' | 'MALE';
export type Student = {
  key: string; name: string; email: string; roll: string; dept: string; year: number; hostel: string; gender: Gender; upi: string; buddy?: boolean;
};

const mk = (key: string, name: string, roll: string, dept: string, year: number, hostel: string, gender: Gender, buddy = false): Student => ({
  key, name, roll, dept, year, hostel, gender, buddy,
  email: `${name.toLowerCase().replace(/[^a-z ]/g, '').replace(' ', '.')}@iiita.ac.in`,
  upi: `${name.split(' ')[0].toLowerCase()}${roll.slice(-3)}@okaxis`,
});

export const DEMO: Student[] = [
  { ...mk('A', 'Ananya Sharma', 'IEC2024123', 'B.Tech ECE', 3, 'GH-2', 'FEMALE', true), email: 'student.female@iiita.ac.in', upi: 'ananya.sharma@okhdfcbank' },
  { ...mk('R', 'Rohan Verma', 'IIT2023087', 'B.Tech IT', 4, 'BH-3', 'MALE', true), email: 'student.male@iiita.ac.in', upi: 'rohan.verma@oksbi' },
  { ...mk('K', 'Kabir Singh', 'IEC2023061', 'B.Tech ECE', 4, 'BH-2', 'MALE', false), email: 'student.lowtrust@iiita.ac.in', upi: 'kabir.singh@okicici' },
];

export const EXTRAS: Student[] = [
  mk('Pr', 'Priya Nair', 'IIT2024031', 'B.Tech IT', 3, 'GH-1', 'FEMALE', true),
  mk('Sn', 'Sneha Gupta', 'IEC2024077', 'B.Tech ECE', 3, 'GH-2', 'FEMALE', true),
  mk('Me', 'Meera Iyer', 'ICM2025012', 'B.Tech CSE', 2, 'GH-3', 'FEMALE', true),
  mk('Ai', 'Aisha Khan', 'IIT2023112', 'B.Tech IT', 4, 'GH-1', 'FEMALE', true),
  mk('Di', 'Divya Rao', 'IEC2025044', 'B.Tech ECE', 2, 'GH-2', 'FEMALE'),
  mk('Ta', 'Tanvi Joshi', 'ICM2024090', 'B.Tech CSE', 3, 'GH-3', 'FEMALE', true),
  mk('Is', 'Ishita Bansal', 'IIT2025058', 'B.Tech IT', 2, 'GH-1', 'FEMALE'),
  mk('Ri', 'Riya Chatterjee', 'IEC2023099', 'B.Tech ECE', 4, 'GH-2', 'FEMALE'),
  mk('Ad', 'Aditya Mishra', 'IIT2023015', 'B.Tech IT', 4, 'BH-3', 'MALE', true),
  mk('Ar', 'Arjun Reddy', 'IEC2024102', 'B.Tech ECE', 3, 'BH-1', 'MALE'),
  mk('Vi', 'Vikram Yadav', 'ICM2023033', 'B.Tech CSE', 4, 'BH-5', 'MALE', true),
  mk('Si', 'Siddharth Jain', 'IIT2024066', 'B.Tech IT', 3, 'BH-2', 'MALE', true),
  mk('Ka', 'Karan Malhotra', 'IEC2025071', 'B.Tech ECE', 2, 'BH-4', 'MALE', true),
  mk('Ha', 'Harsh Tiwari', 'IIT2024118', 'B.Tech IT', 3, 'BH-3', 'MALE'),
  mk('Mo', 'Mohit Saxena', 'ICM2024025', 'B.Tech CSE', 3, 'BH-2', 'MALE'),
  mk('Ni', 'Nikhil Pandey', 'IIT2025090', 'B.Tech IT', 2, 'BH-3', 'MALE'),
];

export const ADMIN = {
  email: 'admin@iiita.ac.in', name: 'IIITA Transport & Student Affairs Office', roll: 'ADM0000001', dept: 'Student Affairs',
};
