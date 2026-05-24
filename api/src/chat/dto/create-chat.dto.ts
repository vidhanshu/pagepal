import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CreateChatDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 255)
  title: string;
}
