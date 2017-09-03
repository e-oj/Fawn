/**
 * @author EmmanuelOlaojo
 * @since 8/13/16
 */

module.exports = function(){
  return Promise.all([
    dbUtils.dropCollection(TEST_COLLECTION_A)
    , dbUtils.dropCollection(TEST_COLLECTION_B)
    , dbUtils.dropCollection(TEST_COLLECTION_C + "s")
    , dbUtils.dropCollection("fs.files")
    , dbUtils.dropCollection("fs.chunks")
  ]);
};
