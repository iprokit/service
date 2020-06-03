/**
 * Helper functions for generic `Model`'s.
 */
export default class Model {
    /**
     * Pagination calculation helper.
     * 
     * @param page the page number.
     * @param size the size of the page, i.e number of records per page.
     */
    public static pagination(page?: number, size?: number) {
        page = (!page || isNaN(page)) ? 0 : page;
        size = (!size || isNaN(size)) ? 20 : size;

        return { offset: page * size, limit: size }
    }
}

//////////////////////////////
//////Types
//////////////////////////////
/**
 * The find options for `model.find()`.
 */
export type FindOptions = {
    /**
     * Order all the records by `model.createdAt`.
     * Set to `new` if latest records should be on the top,
     * `old` if latest records should be at the bottom.
     * 
     * @default `new`
     */
    order?: FindOrder;

    /**
     * Spliting all the records into chunks.
     */
    pagination?: Pagination;
}

/**
 * The order options.
 * 
 * @type new will sort with latest records on the top.
 * @type old will sort with latest records at the bottom.
 */
export type FindOrder = 'new' | 'old';

/**
 * The pagination options to chunk the records.
 */
export type Pagination = {
    /**
     * The page number.
     * 
     * @default 0
     */
    page?: number;

    /**
     * The size of the page, i.e number of records per page.
     * 
     * @default 20
     */
    size?: number;
}