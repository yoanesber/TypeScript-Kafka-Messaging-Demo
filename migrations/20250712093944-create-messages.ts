import { QueryInterface, DataTypes } from "sequelize";

export async function up(queryInterface: QueryInterface) {
    await queryInterface.createTable("messages", {
        id: {
            type: DataTypes.UUID,
            primaryKey: true,
            defaultValue: DataTypes.UUIDV4,
        },
        sender: {
            type: DataTypes.UUID,
            allowNull: false,

        },
        receiver: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        content: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        status: {
            type: DataTypes.STRING(20),
            allowNull: false,
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: queryInterface.sequelize.literal("CURRENT_TIMESTAMP"),
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: queryInterface.sequelize.literal("CURRENT_TIMESTAMP"),
        },
    });
}

export async function down(queryInterface: QueryInterface) {
    await queryInterface.dropTable("messages");
}
