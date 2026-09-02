// Pool of realistic Indian customer names used to synthesize the dataset.
export const FIRST_NAMES = [
  "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Krishna",
  "Ishaan", "Rohan", "Kabir", "Ansh", "Yash", "Dhruv", "Karan", "Aryan",
  "Saanvi", "Ananya", "Diya", "Isha", "Kavya", "Myra", "Pari", "Riya",
  "Anika", "Ira", "Navya", "Sneha", "Priya", "Neha", "Pooja", "Meera",
  "Rahul", "Rajesh", "Suresh", "Amit", "Vikram", "Nikhil", "Manish", "Deepak",
  "Sunita", "Anjali", "Kavita", "Shreya", "Nisha", "Ritu", "Swati", "Divya",
  "Mohammed", "Zoya", "Imran", "Ayesha", "Farhan", "Sana", "Arbaaz", "Nida"
];

export const LAST_NAMES = [
  "Sharma", "Verma", "Gupta", "Iyer", "Nair", "Reddy", "Rao", "Patel",
  "Mehta", "Shah", "Kulkarni", "Joshi", "Desai", "Chopra", "Malhotra",
  "Kapoor", "Singh", "Yadav", "Pillai", "Menon", "Bose", "Banerjee",
  "Chatterjee", "Mukherjee", "Khan", "Ansari", "Sheikh", "Agarwal",
  "Bansal", "Trivedi"
];

export function randomName(rng) {
  const f = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
  const l = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
  return `${f} ${l}`;
}
