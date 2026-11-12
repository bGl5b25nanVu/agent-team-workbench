// Display names are independent of the compatibility identifiers and data directories.
export const PRODUCT_NAME = 'Gongzuo'
export const brandName = locale => String(locale ?? '').toLowerCase().startsWith('zh') ? '共作' : PRODUCT_NAME
