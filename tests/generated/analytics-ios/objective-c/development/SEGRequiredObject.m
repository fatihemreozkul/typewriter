/**
 *  This client was automatically generated by Segment Typewriter. ** Do Not Edit **
 */

#import "SEGRequiredObject.h"

@implementation SEGRequiredObject

+(nonnull instancetype) initWithOptionalSubProperty:(nullable NSString *)optionalSubProperty
requiredSubProperty:(nonnull NSString *)requiredSubProperty {
  SEGRequiredObject *object = [[SEGRequiredObject alloc] init];
  object.optionalSubProperty = optionalSubProperty;
  object.requiredSubProperty = requiredSubProperty;
  return object;
}

-(nonnull SERIALIZABLE_DICT) toDictionary {
  NSMutableDictionary *properties = [[NSMutableDictionary alloc] init];
  if (self.optionalSubProperty != nil) {
      properties[@"optional sub-property"] = self.optionalSubProperty;
  }
  properties[@"required sub-property"] = self.requiredSubProperty;

  return properties;
}

@end