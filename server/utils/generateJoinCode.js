const generateJoinCode = () => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  let code = '';
  
  // Format: 3 letters + 3 numbers
  for (let i = 0; i < 3; i++) {
    code += letters[Math.floor(Math.random() * letters.length)];
  }
  for (let i = 0; i < 3; i++) {
    code += numbers[Math.floor(Math.random() * numbers.length)];
  }
  
  return code;
};

module.exports = generateJoinCode;
