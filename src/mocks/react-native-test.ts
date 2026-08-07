const web = require('react-native-web');

module.exports = {
  ...web,
  Dimensions: {
    get: () => ({ width: 390, height: 844 }),
  },
};
