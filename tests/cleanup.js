/**
 * @author EmmanuelOlaojo
 * @since 8/13/16
 */

module.exports = function(){
  return Promise.all([
    utils.dropCollection(TEST_COLLECTION_A)
    , utils.dropCollection(TEST_COLLECTION_B)
  ]);
};
