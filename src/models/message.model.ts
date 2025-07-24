import { Optional } from 'sequelize';
import {
    Column,
    CreatedAt,
    DataType,
    Default,
    Model,
    PrimaryKey,
    Table,
    UpdatedAt
} from 'sequelize-typescript';

/**
 * Message model represents a message in the messaging system.
 * It includes fields for sender, receiver, content, status, and timestamps.
 */

// Define the base attribute type
interface MessageAttributes {
    id: string;
    sender: string;
    receiver: string;
    content: string;
    status: 'sent' | 'delivered' | 'read';
    createdAt: Date;
    updatedAt: Date;
}

// Define which fields are optional when creating
type MessageCreationAttributes = Optional<MessageAttributes, "id" | "createdAt" | "updatedAt">;

@Table({
    tableName: 'messages',
    timestamps: true,
})
class Message extends Model<MessageAttributes, MessageCreationAttributes> {
    @PrimaryKey
    @Default(DataType.UUIDV4)
    @Column({
        type: DataType.UUID,
        defaultValue: DataType.UUIDV4,
    })
    id!: string;
    
    @Column({
        type: DataType.UUID,
        allowNull: false,
    })
    sender!: string;
    
    @Column({
        type: DataType.UUID,
        allowNull: false,
    })
    receiver!: string;

    @Column({
        type: DataType.TEXT,
        allowNull: false,
    })
    content!: string;

    @Column({
        type: DataType.STRING(20),
        allowNull: false,
        validate: {
            isIn: [['sent', 'delivered', 'read']],
        },
    })
    status!: string;

    @CreatedAt
    @Column({
        type: DataType.DATE,
        allowNull: false,
    })
    createdAt!: Date;

    @UpdatedAt
    @Column({
        type: DataType.DATE,
        allowNull: false,
    })
    updatedAt!: Date;
}

export {
    Message,
    MessageAttributes,
    MessageCreationAttributes,
};