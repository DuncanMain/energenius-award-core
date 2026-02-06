import { Test, TestingModule } from '@nestjs/testing';
import { AwardController } from './award.controller';

describe('AwardController', () => {
  let controller: AwardController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AwardController],
    }).compile();

    controller = module.get<AwardController>(AwardController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
