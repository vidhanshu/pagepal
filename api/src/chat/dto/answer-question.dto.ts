import { IsNotEmpty, IsString } from 'class-validator';

export class AnswerQuestionDto {
  @IsString()
  @IsNotEmpty()
  question: string;
}
