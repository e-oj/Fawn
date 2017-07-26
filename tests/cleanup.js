/**
 * @author EmmanuelOlaojo
 * @since 8/13/16
 */

module.exports = function(){
  return Promise.all([
    dbUtils.dropCollection(TEST_COLLECTION_A)
    , dbUtils.dropCollection(TEST_COLLECTION_B)
  ]);
};
