module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testPathIgnorePatterns: ["dist", 'src/__tests__/utils.ts', 'src/ignore/'],
};
