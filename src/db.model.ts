/**
 * The find options for `model.find()`.
 */
export type FindOptions = {
    /**
     * Order all the records by `model.createdAt`.
     * Set to `new` if latest records should be on the top,
     * `old` if latest records should be at the bottom.
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
     */
    page: number;

    /**
     * The size of the page, i.e number of records per page.
     */
    size: number;
}