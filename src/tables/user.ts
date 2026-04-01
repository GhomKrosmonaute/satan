import { Table } from "@ghom/orm"

export default new Table({
	name: "user",
	description: "Member data",
	columns: (columns) => ({
		_id: columns.increments().primary(),
		id: columns.string().unique(),
		presentation_id: columns.string().nullable(),
	}),
})
