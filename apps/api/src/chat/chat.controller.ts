import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { CreateChatDto } from './dto/create-chat.dto';
import { AnswerQuestionDto } from './dto/answer-question.dto';
import { ChatService } from './chat.service';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('chats')
  getChats() {
    return ['apple'];
  }

  @Post()
  createChat(@Body() createChatDto: CreateChatDto) {
    return this.chatService.createChat(createChatDto);
  }

  @Post(':chatId/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 1024 * 1024 * 5, // 5MB
        files: 1,
      },
      fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              'Invalid file type, only PDF files are allowed',
            ),
            false,
          );
        }
      },
    }),
  )
  uploadPdf(
    @UploadedFile() file: Express.Multer.File,
    @Param('chatId') chatId: string,
  ) {
    return this.chatService.upload(file, chatId);
  }

  @Post(':chatId/answer')
  getAnswer(@Param('chatId') chatId: string, @Body() body: AnswerQuestionDto) {
    return this.chatService.getAnswer(chatId, body.question);
  }
}
